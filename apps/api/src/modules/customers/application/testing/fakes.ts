import { AppError } from '@/shared/errors/AppError.js';
import type {
  Actor,
  CustomerLead,
  IdentityGatewayPort,
  LeadsGatewayPort,
  ProjectSummary,
  ProjectsGatewayPort,
} from '../../domain/ports.js';
import { CustomerViewBuilder } from '../services/customerViews.js';
import {
  AddCustomerUseCase,
  GetCustomerUseCase,
  ImportCustomersUseCase,
  ListCustomersUseCase,
  StartNewProjectForCustomerUseCase,
} from '../usecases/customers.usecases.js';

export const admin: Actor = { id: 'admin1', role: 'ADMIN' };
export const sales1: Actor = { id: 'sales1', role: 'SALES' };
export const sales2: Actor = { id: 'sales2', role: 'SALES' };

/** A stand-in for the leads module's rules: one lead per phone, Sales see only their own. */
export class FakeLeadsGateway implements LeadsGatewayPort {
  rows: CustomerLead[] = [];
  /** Phones that already have a lead with no account yet. */
  plainLeads = new Set<string>();
  started: string[] = [];
  private seq = 0;
  private sees = (a: Actor, l: CustomerLead) => a.role !== 'SALES' || l.assignedToId === a.id;

  async list(actor: Actor, q: { search?: string; page: number; pageSize: number }) {
    const items = this.rows.filter(
      (l) =>
        this.sees(actor, l) && (!q.search || l.name.toLowerCase().includes(q.search.toLowerCase())),
    );
    return { items, total: items.length };
  }
  async find(actor: Actor, customerId: string) {
    const l = this.rows.find((x) => x.customerId === customerId);
    if (!l || !this.sees(actor, l)) throw AppError.notFound('Customer not found.');
    return l;
  }
  async add(
    actor: Actor,
    input: { name: string; phone: string; city: string | null; customerId: string },
  ) {
    const existing = this.rows.find((l) => l.phone === input.phone);
    if (existing) return { lead: existing, outcome: 'existing' as const };
    const lead: CustomerLead = {
      id: `lead${++this.seq}`,
      name: input.name,
      phone: input.phone,
      city: input.city,
      customerId: input.customerId,
      status: 'WON',
      statusChangedAt: new Date('2026-11-01T10:00:00Z'),
      assignedToId: actor.role === 'SALES' ? actor.id : null,
      createdAt: new Date('2026-11-01T10:00:00Z'),
    };
    this.rows.push(lead);
    const linked = this.plainLeads.has(input.phone);
    return { lead, outcome: linked ? ('linked' as const) : ('created' as const) };
  }
  async startNewProject(actor: Actor, customerId: string) {
    const lead = await this.find(actor, customerId);
    lead.status = 'NEW';
    this.started.push(customerId);
    return lead;
  }
}

export class FakeIdentityGateway implements IdentityGatewayPort {
  staffPhones = new Set<string>();
  accounts = new Map<string, string>(); // phone -> id
  names_ = new Map<string, string>([
    ['sales1', 'Ravi'],
    ['sales2', 'Anil'],
  ]);
  async ensureCustomer(input: { name: string; phone: string }) {
    if (this.staffPhones.has(input.phone))
      throw AppError.conflict('This phone number belongs to a staff account.');
    let id = this.accounts.get(input.phone);
    if (!id) {
      id = `cust-${this.accounts.size + 1}`;
      this.accounts.set(input.phone, id);
    }
    return { id };
  }
  async names(ids: string[]) {
    return ids.filter((i) => this.names_.has(i)).map((id) => ({ id, name: this.names_.get(id)! }));
  }
}

export class FakeProjectsGateway implements ProjectsGatewayPort {
  rows: ProjectSummary[] = [];
  async forCustomers(ids: string[]) {
    return this.rows.filter((p) => ids.includes(p.customerId));
  }
}

export function world() {
  const leads = new FakeLeadsGateway();
  const identity = new FakeIdentityGateway();
  const projects = new FakeProjectsGateway();
  const views = new CustomerViewBuilder(projects, identity);
  return {
    leads,
    identity,
    projects,
    list: new ListCustomersUseCase(leads, views),
    get: new GetCustomerUseCase(leads, views),
    add: new AddCustomerUseCase(leads, identity, views),
    importer: new ImportCustomersUseCase(leads, identity),
    start: new StartNewProjectForCustomerUseCase(leads, views),
  };
}
