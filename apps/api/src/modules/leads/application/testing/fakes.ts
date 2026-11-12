import { AppError } from '@/shared/errors/AppError.js';
import type { LeadAssignedEvent, LeadWonEvent } from '@/shared/events/appEvents.js';
import type { CallRecord, CallStat, NewCallRecord } from '../../domain/call.entity.js';
import type { CallRepositoryPort } from '../../domain/call.repository.port.js';
import type { Lead, LeadListFilter, LeadPatch, NewLead } from '../../domain/lead.entity.js';
import type { LeadActivity, NewLeadActivity } from '../../domain/leadActivity.entity.js';
import type { LeadActivityRepositoryPort } from '../../domain/leadActivity.repository.port.js';
import type { LeadEventsPort } from '../../domain/leadEvents.port.js';
import type { LeadRepositoryPort, StuckQuery } from '../../domain/lead.repository.port.js';
import type {
  CustomerRef,
  DirectoryUser,
  UserDirectoryPort,
} from '../../domain/userDirectory.port.js';
import type { NewVisit, Visit } from '../../domain/visit.entity.js';
import type { VisitRepositoryPort } from '../../domain/visit.repository.port.js';
import { LeadAccess, type Actor } from '../services/leadAccess.js';
import { LeadViewBuilder } from '../services/leadViews.js';

/** In-memory ports for use-case tests. They honour the same contracts as the Mongo adapters. */

export class FakeLeads implements LeadRepositoryPort {
  rows: Lead[] = [];
  private seq = 0;
  async findById(id: string) {
    return this.rows.find((l) => l.id === id) ?? null;
  }
  async findByPhone(phone: string) {
    return this.rows.find((l) => l.phone === phone) ?? null;
  }
  async findByPhones(phones: string[]) {
    return this.rows.filter((l) => phones.includes(l.phone));
  }
  async findByIds(ids: string[]) {
    return this.rows.filter((l) => ids.includes(l.id));
  }
  async findByCustomerId(customerId: string) {
    return this.rows.find((l) => l.customerId === customerId) ?? null;
  }
  async findStuck(q: StuckQuery) {
    return this.rows
      .filter(
        (l) =>
          l.statusChangedAt < q.before &&
          l.statusChangedAt > q.after &&
          !['WON', 'LOST', ...q.excludeStatuses].includes(l.status),
      )
      .slice(0, q.limit);
  }
  async create(lead: NewLead) {
    if (this.rows.some((l) => l.phone === lead.phone)) throw AppError.conflict('dup');
    const created: Lead = {
      ...lead,
      newProjectRequested: lead.newProjectRequested ?? false,
      id: `l${++this.seq}`,
      createdAt: new Date(),
    };
    this.rows.push(created);
    return created;
  }
  async update(id: string, patch: LeadPatch) {
    const lead = this.rows.find((l) => l.id === id);
    if (!lead) return null;
    Object.assign(lead, patch);
    return lead;
  }
  lastFilter: LeadListFilter | undefined;
  async list(filter: LeadListFilter) {
    this.lastFilter = filter;
    const items = this.rows.filter(
      (l) =>
        (filter.assignedToId === undefined || l.assignedToId === filter.assignedToId) &&
        (!filter.customersOnly || l.customerId !== null),
    );
    return { items, total: items.length };
  }
}

export class FakeCalls implements CallRepositoryPort {
  rows: CallRecord[] = [];
  async record(call: NewCallRecord) {
    const same = this.rows.find(
      (c) =>
        c.leadId === call.leadId &&
        c.userId === call.userId &&
        c.startedAt.getTime() === call.startedAt.getTime(),
    );
    if (same) return { call: same, created: false };
    const created: CallRecord = { ...call, id: `c${this.rows.length + 1}` };
    this.rows.push(created);
    return { call: created, created: true };
  }
  async listByLead(leadId: string) {
    return this.rows.filter((c) => c.leadId === leadId);
  }
  async statsByUser(from: Date, to: Date): Promise<CallStat[]> {
    const byUser = new Map<string, CallStat>();
    for (const c of this.rows) {
      if (c.startedAt < from || c.startedAt >= to) continue;
      const s = byUser.get(c.userId) ?? { userId: c.userId, calls: 0, answered: 0, talkSeconds: 0 };
      s.calls++;
      if (c.answered) s.answered++;
      s.talkSeconds += c.durationSec;
      byUser.set(c.userId, s);
    }
    return [...byUser.values()];
  }
}

export class FakeVisits implements VisitRepositoryPort {
  rows: Visit[] = [];
  async create(v: NewVisit) {
    const created: Visit = { ...v, id: `v${this.rows.length + 1}` };
    this.rows.push(created);
    return created;
  }
  async listByLead(leadId: string) {
    return this.rows.filter((v) => v.leadId === leadId);
  }
}

export class FakeActivities implements LeadActivityRepositoryPort {
  rows: LeadActivity[] = [];
  async add(a: NewLeadActivity) {
    this.rows.push({ ...a, id: `a${this.rows.length + 1}` });
  }
  async listByLead(leadId: string) {
    return this.rows.filter((a) => a.leadId === leadId).reverse();
  }
  types(leadId: string) {
    return this.rows.filter((a) => a.leadId === leadId).map((a) => a.type);
  }
}

export class FakeDirectory implements UserDirectoryPort {
  users: DirectoryUser[] = [
    { id: 'admin1', name: 'Owner', role: 'ADMIN' },
    { id: 'sales1', name: 'Ravi', role: 'SALES' },
    { id: 'sales2', name: 'Asha', role: 'SALES' },
    { id: 'office1', name: 'Rita', role: 'OFFICE' },
    { id: 'designer1', name: 'Dev', role: 'DESIGNER' },
  ];
  customersCreated: Array<{ name: string; phone: string }> = [];
  async find(ids: string[]) {
    return this.users.filter((u) => ids.includes(u.id));
  }
  async ensureCustomer(input: { name: string; phone: string }): Promise<CustomerRef> {
    this.customersCreated.push(input);
    return { id: `cust-${input.phone}` };
  }
}

export class FakeEvents implements LeadEventsPort {
  won: LeadWonEvent[] = [];
  leadWon(event: LeadWonEvent) {
    this.won.push(event);
  }
  assigned: LeadAssignedEvent[] = [];
  leadAssigned(event: LeadAssignedEvent) {
    this.assigned.push(event);
  }
}

export const admin: Actor = { id: 'admin1', role: 'ADMIN' };
export const sales1: Actor = { id: 'sales1', role: 'SALES' };
export const sales2: Actor = { id: 'sales2', role: 'SALES' };
export const office: Actor = { id: 'office1', role: 'OFFICE' };

export function world(now: () => Date = () => new Date()) {
  const leads = new FakeLeads();
  const calls = new FakeCalls();
  const visits = new FakeVisits();
  const activities = new FakeActivities();
  const directory = new FakeDirectory();
  const events = new FakeEvents();
  const access = new LeadAccess(leads);
  const views = new LeadViewBuilder(directory, async () => 2, now);
  return { leads, calls, visits, activities, directory, events, access, views, now };
}

export async function addLead(w: ReturnType<typeof world>, over: Partial<NewLead> = {}) {
  return w.leads.create({
    name: 'Mrs Rao',
    phone: '9876500001',
    altPhone: null,
    email: null,
    city: 'Siliguri',
    notes: null,
    source: 'WEBSITE',
    status: 'NEW',
    statusChangedAt: w.now(),
    assignedToId: 'sales1',
    lostReason: null,
    customerId: null,
    createdById: 'admin1',
    ...over,
  });
}
